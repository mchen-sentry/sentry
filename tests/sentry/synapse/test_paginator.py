from __future__ import annotations

import pytest
from rest_framework.exceptions import ParseError

from sentry.models.organizationmapping import OrganizationMapping
from sentry.synapse.paginator import Cursor, SynapsePaginator
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test

# Out-of-range `updated_at` integers that Cursor.decode must reject with ParseError.
# Covers the three exception types datetime.fromtimestamp raises for out-of-range
# epochs: ValueError (year >= 10000), OverflowError (timestamp out of range for
# platform time_t), and OSError (errno 75 / value too large).
_OUT_OF_RANGE_UPDATED_AT = [
    253_402_300_800,  # year 10000, smallest trigger -> ValueError
    99_999_999_999_999,  # year ~3.17M -> ValueError
    99_999_999_999_999_999,  # -> OSError
    2**63,  # -> OverflowError
    2**63 + 1,  # -> OverflowError
    -1_000_000_000_000_000_000,  # negative -> OSError
]


# `Cursor.decode` is pure (no DB/silo state), so these run as module-level
# parametrized functions. (The silo test wrapper overrides `_callTestMethod`,
# which drops the parametrize args when applied to unittest.TestCase methods.)
@pytest.mark.parametrize(
    "updated_at", _OUT_OF_RANGE_UPDATED_AT, ids=[str(v) for v in _OUT_OF_RANGE_UPDATED_AT]
)
def test_decode_out_of_range_updated_at_raises(updated_at: int) -> None:
    # A structurally-valid base64+JSON cursor whose `updated_at` is outside the
    # representable datetime range must be rejected as an invalid cursor (400),
    # not escape decode and blow up later in get_result as an uncaught 500.
    bad_cursor = Cursor(updated_at=updated_at, id=1).encode()
    with pytest.raises(ParseError):
        Cursor.decode(bad_cursor)


@control_silo_test
class CursorTest(TestCase):
    def test_encode_decode(self) -> None:
        original = Cursor(updated_at=1234567890, id=42)
        assert Cursor.decode(original.encode()) == original

    def test_decode_invalid_cursor_raises(self) -> None:
        with pytest.raises(ParseError):
            Cursor.decode("!!!not-base64!!!")

    def test_decode_in_range_boundary_updated_at_succeeds(self) -> None:
        # The largest in-range epoch (year 9999, 253_402_300_799) must still decode.
        # Guards against the range check being too aggressive and rejecting valid cursors.
        original = Cursor(updated_at=253_402_300_799, id=42)
        assert Cursor.decode(original.encode()) == original


@control_silo_test
class SynapsePaginatorTest(TestCase):
    def test_paginates(self) -> None:
        orgs = [self.create_organization() for _ in range(5)]
        paginator = SynapsePaginator(
            queryset=OrganizationMapping.objects.all(),
            id_field="organization_id",
            timestamp_field="date_updated",
        )

        cursor = None

        expected = [
            # org ids, expected has_more
            ([orgs[0].id, orgs[1].id], True),
            ([orgs[2].id, orgs[3].id], True),
            ([orgs[4].id], False),
        ]

        for ids, expected_more in expected:
            page = paginator.get_result(limit=2, cursor_str=cursor)
            assert page.has_more is expected_more
            assert set(ids) == {r.organization_id for r in page.results}
            cursor = page.next_cursor
