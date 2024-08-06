# OCAPI Hook Circuit Breaker
## How It Works
Each extension point type has its own circuit breaker instance that tracks the rate of failed executions for that hook. The circuit breaker can be in one of three states: closed, open, or half-open. Normally, it’s closed. **If at any time, the 100 most recent calls to the hook include more than 50 failures, the following process is triggered**:

1. The circuit breaker’s status changes to ``open``. This change is logged.
2. For 60 seconds, any calls to the failing extension point return an HTTP Status Code ``503 (Service Unavailable)`` with the fault type ``HookCircuitBreakerException``.
3. After 60 seconds, the circuit breaker’s status changes to ``half-open``. This change is logged.
4. The circuit breaker tracks the next **10** calls to the failing extension point. If more than **5** of them fail, return to step 1.
5. The circuit breaker’s status changes to ``closed`` and it resumes tracking calls to the hook. This change is logged.