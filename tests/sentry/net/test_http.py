from __future__ import annotations

import ipaddress
import socket
import threading
from typing import cast
from unittest.mock import MagicMock, patch

import pytest

from sentry.exceptions import RestrictedIPAddress
from sentry.net import http as net_http
from sentry.net.http import (
    BlacklistAdapter,
    SafeHTTPConnectionPool,
    SafeHTTPSConnectionPool,
    SafeSession,
    _is_proxy_ipaddress_allowed,
)
from sentry.net.socket import is_ipaddress_allowed

deny_all = lambda ip: False
allow_all = lambda ip: True
only_cell = lambda ip: ip == "10.0.0.1"


def _networks(*cidrs: str) -> frozenset[ipaddress.IPv4Network | ipaddress.IPv6Network]:
    return frozenset(ipaddress.ip_network(c, strict=False) for c in cidrs)


def _find_restricted(exc: BaseException) -> bool:
    cur: BaseException | None = exc
    seen = 0
    while cur is not None and seen < 20:
        if isinstance(cur, RestrictedIPAddress):
            return True
        nxt = cur.__cause__ or cur.__context__
        if nxt is cur:
            break
        cur = nxt
        seen += 1
    return False


def _start_stub_proxy() -> str:
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", 0))
    srv.listen(5)
    host, port = srv.getsockname()

    def serve() -> None:
        while True:
            try:
                conn, _ = srv.accept()
            except OSError:
                return
            try:
                conn.recv(65536)
            except OSError:
                pass
            try:
                conn.sendall(b"HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n")
            except OSError:
                pass
            try:
                conn.close()
            except OSError:
                pass

    threading.Thread(target=serve, daemon=True).start()
    return f"http://127.0.0.1:{port}"


@pytest.fixture
def stub_proxy() -> str:
    return _start_stub_proxy()


# ---------------------------------------------------------------------------
# Unit tests for the proxy IP-permission helper
# ---------------------------------------------------------------------------


class TestIsProxyIpaddressAllowed:
    def test_exempted_ip_allowed_regardless_of_base_checker(self) -> None:
        with patch.object(net_http, "ALLOWED_PROXY_IPS", _networks("127.0.0.0/8")):
            assert _is_proxy_ipaddress_allowed("127.0.0.1", deny_all) is True
            # The base checker is never consulted for an exempted IP.
            assert _is_proxy_ipaddress_allowed("127.0.0.1", only_cell) is True

    def test_non_exempted_ip_delegates_to_base_checker(self) -> None:
        with patch.object(net_http, "ALLOWED_PROXY_IPS", _networks("127.0.0.0/8")):
            assert _is_proxy_ipaddress_allowed("8.8.8.8", deny_all) is False
            assert _is_proxy_ipaddress_allowed("10.0.0.1", only_cell) is True
            assert _is_proxy_ipaddress_allowed("8.8.8.8", only_cell) is False

    def test_no_exemption_delegates_to_base_checker(self) -> None:
        with patch.object(net_http, "ALLOWED_PROXY_IPS", frozenset()):
            assert _is_proxy_ipaddress_allowed("8.8.8.8", deny_all) is False
            assert _is_proxy_ipaddress_allowed("8.8.8.8", allow_all) is True

    def test_none_base_falls_back_to_default_blocklist(self) -> None:
        is_ipaddress_allowed.cache_clear()
        with patch.object(net_http, "ALLOWED_PROXY_IPS", frozenset()):
            # 127.0.0.1 is in the default SENTRY_DISALLOWED_IPS blocklist.
            assert _is_proxy_ipaddress_allowed("127.0.0.1", None) is False
            # A public IP is permitted by the default blocklist.
            assert _is_proxy_ipaddress_allowed("8.8.8.8", None) is True


# ---------------------------------------------------------------------------
# Structural tests: ProxyManager is wired with the Safe* pools
# ---------------------------------------------------------------------------


class TestProxyManagerStructure:
    def test_proxy_manager_uses_safe_pools(self) -> None:
        sess = SafeSession(is_ipaddress_permitted=deny_all)
        adapter = cast(BlacklistAdapter, sess.adapters["https://"])
        pm = adapter.proxy_manager_for("http://proxy.example:3128")
        assert pm.pool_classes_by_scheme["http"].func is SafeHTTPConnectionPool
        assert pm.pool_classes_by_scheme["https"].func is SafeHTTPSConnectionPool
        # is_ipaddress_permitted is threaded through to the proxy pools.
        for cls in pm.pool_classes_by_scheme.values():
            assert "is_ipaddress_permitted" in cls.keywords
            assert cls.keywords["is_ipaddress_permitted"] is not None

    def test_proxy_manager_is_cached(self) -> None:
        sess = SafeSession()
        adapter = cast(BlacklistAdapter, sess.adapters["https://"])
        pm1 = adapter.proxy_manager_for("http://proxy.example:3128")
        pm2 = adapter.proxy_manager_for("http://proxy.example:3128")
        assert pm1 is pm2

    def test_socks_proxy_delegates_to_base(self) -> None:
        from urllib3.connectionpool import HTTPConnectionPool

        sess = SafeSession()
        adapter = cast(BlacklistAdapter, sess.adapters["https://"])
        pm = adapter.proxy_manager_for("socks5://proxy.example:1080")
        assert pm is not None
        # SOCKS proxies are forwarded to the base implementation, which builds a
        # SOCKS-specific pool (a subclass of the stock HTTPConnectionPool), not
        # our Safe* variant. Safe-IP enforcement for SOCKS is out of scope.
        assert issubclass(pm.pool_classes_by_scheme["http"], HTTPConnectionPool)
        assert pm.pool_classes_by_scheme["http"] is not SafeHTTPConnectionPool


# ---------------------------------------------------------------------------
# Behavioral tests: end-to-end through a stub forward proxy
# ---------------------------------------------------------------------------


class TestProxyIpAddressValidation:
    def test_no_proxy_raises_restricted_ip_for_denied_destination(self, stub_proxy: str) -> None:
        # Regression guard: the no-proxy path already enforces is_ipaddress_permitted.
        sess = SafeSession(is_ipaddress_permitted=deny_all)
        with pytest.raises(Exception) as exc_info:
            sess.get("http://192.0.2.1/", timeout=2)
        assert _find_restricted(exc_info.value)

    def test_proxy_raises_restricted_ip_for_denied_proxy_host(self, stub_proxy: str) -> None:
        # Core bug: with a proxy configured, the proxy host IP used to bypass
        # is_ipaddress_permitted entirely. After the fix it is enforced.
        with patch.object(net_http, "ALLOWED_PROXY_IPS", frozenset()):
            sess = SafeSession(is_ipaddress_permitted=deny_all)
            sess.proxies = {"http": stub_proxy, "https": stub_proxy}
            with pytest.raises(Exception) as exc_info:
                sess.get("http://192.0.2.1/", timeout=3)
            assert _find_restricted(exc_info.value)

    @patch("socket.getaddrinfo")
    def test_proxy_arbitrary_ip_is_validated(
        self, mock_getaddrinfo: MagicMock, stub_proxy: str
    ) -> None:
        # The check is not special-cased to loopback: an arbitrary resolved
        # proxy host IP is validated too.
        mock_getaddrinfo.return_value = [(2, 1, 6, "", ("192.0.2.7", 0))]
        with patch.object(net_http, "ALLOWED_PROXY_IPS", frozenset()):
            sess = SafeSession(is_ipaddress_permitted=deny_all)
            sess.proxies = {"http": "http://proxy.test:3128", "https": "http://proxy.test:3128"}
            with pytest.raises(Exception) as exc_info:
                sess.get("http://example.com/", timeout=2)
            assert _find_restricted(exc_info.value)

    def test_proxy_rejected_by_default_blocklist_without_exemption(self, stub_proxy: str) -> None:
        # A proxy host on loopback (127.0.0.0/8 is in the default blocklist) is
        # rejected by the default is_ipaddress_allowed when not exempted.
        is_ipaddress_allowed.cache_clear()
        with patch.object(net_http, "ALLOWED_PROXY_IPS", frozenset()):
            sess = SafeSession()  # is_ipaddress_permitted=None -> default blocklist
            sess.proxies = {"http": stub_proxy, "https": stub_proxy}
            with pytest.raises(Exception) as exc_info:
                sess.get("http://192.0.2.1/", timeout=3)
            assert _find_restricted(exc_info.value)

    def test_proxy_allowed_by_default_blocklist_when_exempted(self, stub_proxy: str) -> None:
        # An operator lists the trusted proxy host in SENTRY_ALLOWED_PROXY_IPS
        # to exempt it from the default blocklist; the request reaches the proxy.
        is_ipaddress_allowed.cache_clear()
        with patch.object(net_http, "ALLOWED_PROXY_IPS", _networks("127.0.0.0/8")):
            sess = SafeSession()  # default blocklist
            sess.proxies = {"http": stub_proxy, "https": stub_proxy}
            raised = False
            status = None
            try:
                resp = sess.get("http://192.0.2.1/", timeout=3)
                status = resp.status_code
            except RestrictedIPAddress:
                raised = True
            except Exception:
                pass  # tolerate transport quirks; RestrictedIPAddress is the bug
            assert not raised, "exempted proxy host must not raise RestrictedIPAddress"
            assert status == 502  # reached the stub forward proxy

    def test_per_silo_checker_rejects_non_allowlisted_proxy_host(self, stub_proxy: str) -> None:
        # validate_cell_ip_address / is_control_silo_ip_address style checker:
        # the proxy host (127.0.0.1) is not in the silo allowlist -> rejected.
        with patch.object(net_http, "ALLOWED_PROXY_IPS", frozenset()):
            sess = SafeSession(is_ipaddress_permitted=only_cell)
            sess.proxies = {"http": stub_proxy, "https": stub_proxy}
            with pytest.raises(Exception) as exc_info:
                sess.get("http://192.0.2.1/", timeout=3)
            assert _find_restricted(exc_info.value)

    def test_per_silo_checker_allows_exempted_proxy_host(self, stub_proxy: str) -> None:
        # SENTRY_ALLOWED_PROXY_IPS exempts the proxy host even from a per-silo
        # allowlist checker, so egress can route through a trusted proxy.
        with patch.object(net_http, "ALLOWED_PROXY_IPS", _networks("127.0.0.0/8")):
            sess = SafeSession(is_ipaddress_permitted=only_cell)
            sess.proxies = {"http": stub_proxy, "https": stub_proxy}
            raised = False
            status = None
            try:
                resp = sess.get("http://192.0.2.1/", timeout=3)
                status = resp.status_code
            except RestrictedIPAddress:
                raised = True
            except Exception:
                pass
            assert not raised
            assert status == 502

    def test_proxy_allowlist_does_not_exempt_direct_destination(self) -> None:
        # The exemption is scoped to the proxy *host* connection: it must not
        # leak into direct (non-proxy) destination connections.
        is_ipaddress_allowed.cache_clear()
        with patch.object(net_http, "ALLOWED_PROXY_IPS", _networks("127.0.0.0/8")):
            sess = SafeSession()  # default blocklist, no proxy configured
            with pytest.raises(Exception) as exc_info:
                sess.get("http://127.0.0.1:9/", timeout=2)
            assert _find_restricted(exc_info.value)
