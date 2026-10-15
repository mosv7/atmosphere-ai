"""Bounded per-process limits. Deploy one API worker or enforce shared limits at proxy."""
import time
from collections import OrderedDict, deque


class RateLimiter:
    def __init__(self):
        self.entries = OrderedDict()

    def clear(self):
        self.entries.clear()

    def allow(self, key, limit, window=60):
        now = time.monotonic()
        events = self.entries.setdefault(key, deque())
        self.entries.move_to_end(key)
        while events and events[0] <= now - window:
            events.popleft()
        if len(events) >= limit:
            return max(1, int(window - now + events[0]) + 1)
        events.append(now)
        while len(self.entries) > 4096:
            self.entries.popitem(last=False)
        return 0


limiter = RateLimiter()
