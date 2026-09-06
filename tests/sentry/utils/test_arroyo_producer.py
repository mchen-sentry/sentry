import atexit
from collections.abc import Callable, Iterator
from typing import cast
from unittest.mock import Mock, patch

import pytest
from arroyo.backends.abstract import SimpleProducerFuture
from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from arroyo.backends.local.backend import LocalBroker, LocalProducer
from arroyo.backends.local.storages.memory import MemoryMessageStorage
from arroyo.types import BrokerValue, Partition, Topic

from sentry.testutils.asserts import assert_mock_called_once_with_partial
from sentry.testutils.helpers.options import override_options
from sentry.utils.arroyo_producer import SingletonProducer, get_arroyo_producer

_Future = SimpleProducerFuture[BrokerValue[KafkaPayload]]


class _FakeProducer:
    """
    Minimal producer that hands back real arroyo ``SimpleProducerFuture``
    objects, so ``result()`` exercises its real contract (raise on
    ``set_exception``, return on ``set_result``) without a broker. Only the
    ``produce``/``close`` surface used by ``SingletonProducer`` is implemented.
    """

    def __init__(self) -> None:
        self.futures: list[_Future] = []

    def produce(self, destination: Topic | Partition, payload: KafkaPayload) -> _Future:
        future: _Future = SimpleProducerFuture()
        self.futures.append(future)
        return future

    def close(self) -> None:
        return None


@pytest.fixture
def make_producer() -> Iterator[Callable[..., SingletonProducer]]:
    """
    Builds ``SingletonProducer`` instances for tests, unregistering each one's
    atexit shutdown handler on teardown. ``_shutdown`` calls ``result()`` on
    every tracked future, and a pending ``SimpleProducerFuture.result()`` blocks
    indefinitely until resolved -- unregistering prevents leftover pending
    futures from hanging the test process at interpreter exit.
    """
    producers: list[SingletonProducer] = []

    def _make(
        inner: _FakeProducer | LocalProducer[KafkaPayload], *, max_futures: int
    ) -> SingletonProducer:
        producer = SingletonProducer(
            cast("Callable[[], KafkaProducer]", lambda: inner),
            max_futures=max_futures,
        )
        producers.append(producer)
        return producer

    yield _make

    for producer in producers:
        atexit.unregister(producer._shutdown)


def _payload(value: bytes = b"x") -> KafkaPayload:
    return KafkaPayload(key=None, value=value, headers=[])


def test_registers_shutdown_at_construction() -> None:
    # The shutdown must be registered eagerly (not on first produce) so atexit's
    # LIFO ordering runs it after anything that flushes into the producer at exit.
    def dummy_producer() -> KafkaProducer:
        raise AssertionError("no producer")

    with patch("sentry.utils.arroyo_producer.atexit.register") as register:
        producer = SingletonProducer(dummy_producer)

    register.assert_called_once_with(producer._shutdown)


def test_shutdown_is_noop_without_producer() -> None:
    # A producer that is never used must shut down cleanly.
    def dummy_producer() -> KafkaProducer:
        raise AssertionError("no producer")

    producer = SingletonProducer(dummy_producer)
    producer._shutdown()


def test_track_futures() -> None:
    def dummy_producer() -> KafkaProducer:
        raise AssertionError("no producer")

    producer = SingletonProducer(dummy_producer, max_futures=2)

    first_future_mock = Mock()
    first_future_mock.result = Mock()

    second_future_mock = Mock()
    second_future_mock.result = Mock()

    producer._track_futures(first_future_mock)
    first_future_mock.result.assert_not_called()
    producer._track_futures(second_future_mock)
    first_future_mock.result.assert_called_once_with()
    second_future_mock.assert_not_called()


@override_options(
    {
        "arroyo.producer.record_poll_metrics": ["producer.fake"],
        "arroyo.producer.poll_metric_frequency": 1,
    }
)
@patch("sentry.utils.arroyo_producer.KafkaProducer")
@patch("sentry.utils.arroyo_producer.build_kafka_producer_configuration")
def test_poll_metrics(mock_build_config: Mock, mock_producer: Mock) -> None:
    get_arroyo_producer("producer.fake", "fake-topic")
    assert_mock_called_once_with_partial(
        mock_producer, record_poll_metrics=True, poll_metric_frequency=1
    )


@override_options(
    {
        "arroyo.producer.record_poll_metrics": [],
        "arroyo.producer.poll_metric_frequency": 1,
    }
)
@patch("sentry.utils.arroyo_producer.KafkaProducer")
@patch("sentry.utils.arroyo_producer.build_kafka_producer_configuration")
def test_poll_metrics_not_enabled(mock_build_config: Mock, mock_producer: Mock) -> None:
    get_arroyo_producer("producer.fake", "fake-topic")
    assert_mock_called_once_with_partial(
        mock_producer, record_poll_metrics=False, poll_metric_frequency=1
    )


def test_track_futures_swallows_oldest_future_failure(
    make_producer: Callable[..., SingletonProducer],
) -> None:
    # Regression: when the deque fills and the popped *oldest* future resolved
    # with a delivery failure, the backpressure ``result()`` call must not
    # propagate that failure out of the unrelated ``_track_futures`` call.
    producer = make_producer(_FakeProducer(), max_futures=2)

    fut_a: _Future = SimpleProducerFuture()
    fut_a.set_exception(RuntimeError("delivery of message A failed"))
    fut_b: _Future = SimpleProducerFuture()

    producer._track_futures(fut_a)
    # Below the cap: oldest is not awaited yet, both the new and tracked future
    # are untouched.
    assert len(producer._futures) == 1
    assert producer._futures[0] is fut_a

    # Reaching the cap pops fut_a (oldest) and awaits it. fut_a.result() raises,
    # but the backpressure path swallows -- this call must not raise.
    producer._track_futures(fut_b)

    # fut_a was popped (no leak into the deque); fut_b, the newest, stays tracked
    # and unconsumed.
    assert len(producer._futures) == 1
    assert producer._futures[0] is fut_b


def test_produce_does_not_raise_unrelated_oldest_delivery_failure(
    make_producer: Callable[..., SingletonProducer],
) -> None:
    # End-to-end regression (the report's reproduction): producing message B
    # must not raise the delivery failure of the unrelated, ~max_futures-older
    # message A that the backpressure path happens to pop and await.
    producer = make_producer(_FakeProducer(), max_futures=2)
    destination = Topic("dest")

    fut_a = producer.produce(destination, _payload(b"A"))
    fut_a.set_exception(RuntimeError("delivery of message A failed"))

    # In the buggy version this raised A's RuntimeError out of B's produce().
    fut_b = producer.produce(destination, _payload(b"B"))

    # B's own future is handed back to its caller and remains the tracked newest.
    assert fut_b is producer._futures[-1]
    assert not fut_b.done()


def test_produce_misattribution_does_not_chain_to_later_caller(
    make_producer: Callable[..., SingletonProducer],
) -> None:
    # Regression for the chain: once the backpressure path stops raising, a
    # failed future that stays tracked cannot have its exception re-raised out
    # of a *third*, unrelated produce() call further down the deque.
    producer = make_producer(_FakeProducer(), max_futures=2)
    destination = Topic("dest")

    fut_a = producer.produce(destination, _payload(b"A"))
    fut_a.set_exception(RuntimeError("delivery of message A failed"))

    fut_b = producer.produce(destination, _payload(b"B"))  # backpressure pops & swallows A
    fut_b.set_exception(RuntimeError("delivery of message B failed"))

    # In the buggy version this raised B's RuntimeError out of C's produce().
    fut_c = producer.produce(destination, _payload(b"C"))  # backpressure pops & swallows B

    assert fut_c is producer._futures[-1]
    assert not fut_c.done()


def test_produce_with_local_producer_applies_backpressure_and_returns_resolvable_futures(
    make_producer: Callable[..., SingletonProducer],
) -> None:
    # Integration: against arroyo's real LocalProducer + MemoryMessageStorage the
    # success-path backpressure still paces (pops and awaits the oldest future)
    # and produce() returns resolvable futures, exactly as before the fix.
    storage: MemoryMessageStorage[KafkaPayload] = MemoryMessageStorage()
    broker = LocalBroker(storage)
    topic = Topic("backpressure-topic")
    broker.create_topic(topic, 1)
    partition = Partition(topic, 0)
    producer = make_producer(broker.get_producer(), max_futures=2)

    payload_a = _payload(b"A")
    payload_b = _payload(b"B")
    payload_c = _payload(b"C")

    fut_a = producer.produce(partition, payload_a)  # deque: [A]
    fut_b = producer.produce(partition, payload_b)  # backpressure pops A, deque: [B]
    fut_c = producer.produce(partition, payload_c)  # backpressure pops B, deque: [C]

    # The returned futures are resolved to BrokerValues carrying the right payload.
    assert fut_a.result().payload is payload_a
    assert fut_b.result().payload is payload_b
    assert fut_c.result().payload is payload_c
    # Backpressure popped the oldest each time; only the newest remains tracked.
    assert len(producer._futures) == 1
    assert producer._futures[0] is fut_c


def test_shutdown_swallows_failed_tracked_futures(
    make_producer: Callable[..., SingletonProducer],
) -> None:
    # Consistency contract the fix aligns with: _shutdown already swallows
    # delivery failures of tracked futures (teardown must not raise). Locks that
    # in alongside the _track_futures swallow so the two stay in agreement.
    producer = make_producer(_FakeProducer(), max_futures=10)
    destination = Topic("dest")

    fut_a = producer.produce(destination, _payload(b"A"))
    fut_a.set_exception(RuntimeError("delivery of message A failed"))

    producer._shutdown()  # must not raise A's exception
