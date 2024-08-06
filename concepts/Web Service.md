# Web Service
## Service Framework
SFCC Service Framework simplifies and enchances the management of web service calls.
1. Service Instance Creation:
    - Use ```dw.svc.LocalServiceRegistry.createService()``` method. It requires two agrs:
      - The ID of a service configured in BM
      - A configuration object with callback handers that needs to be implemented
    - Callback handlers, such as ```createRequest```, ```parseResponse```, and ```mockCall```, contain code executed at specific times by the service framework.
2. Service Callbacks:
    - When invoking a web service using ```dw.svc.Service.call(Object...)```, the service framework checks for [rate limiter](#rate-limiter) and [circuit breaker](#circuit-breaker) thresholds before making the call.
    - Callback methods defined by the ```dw.svc.ServiceCallback``` class are invoked in a specifc order:
      - ```initServiceclient```: Creates the underlying client for web services.
      - ```createRequest```: Create the service request
      - ```execute```: Performs the actual request
      - ```parseResponse```: Convert the call result into an object to be returned
3. Web Service Calls:
      - Use ```Service.call``` to invoke the web services.
      - Callback methods in the service instance are executed, and the result is stored in the ```dw.svc.Result``` object.
4. Underlying Clients Configuration:
      - The service framework wraps underlying clients like ```FTPClient``` and ```HTTPClient```, allowing direct configuration when needed
      - Use the ```getClient``` method to access underlying client objects for specific services, enabling advanced configurations like caching for HTTPService calls
5. Class Service:
      - It includes properties like ```configuration```, ```credentialID```, ```mock``` status, ```requestData```, ```response```, ```throwOnError```, and ```URL```, along with methods for service invocation and configuration.
 
## Rate Limiter
The rate limiter allows a maximum number of calls to a web service in a specified time interval. If the rate limit is reached, a ``ServiceUnavailableException`` is thrown.

## Circuit Breaker
The circuit breaker suspends calls to a web service if a certain number of calls fail within a specified time interval. If the rate limit is reached, a ``ServiceUnavailableException`` is thrown.