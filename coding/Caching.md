# Caching

## OCAPI Caching
OCAPI error response could be cached. If race conditions happen, this will result in incorrect responses in retries. Disabling OCAPI error response cache can be configured in BM.
For OCAPI, only GET calls can be cached. The Data API does not support caching at all. By default, GET responses that support caching are cached for 60 seconds. It is possible to override the default 60 seconds of caching of an resource by adding it to the OCAPI Settings in the Business Manager. You can set a maximum value of 86,400 seconds (1 day).

Currently, you can’t control the server-side cache times of SCAPI. 

~~## Page Caching~~
~~If different pagecache settings are supplied for different components of the page, the response takes on the shortest of the pagecache settings. For example, if you have a page where:~~

~~Component A has a 1-minute relative pagecaching.~~
~~Component B has a 1-hour relative pagecaching.~~
~~Component C has a 1-day relative pagecaching.~~
~~The final calculated relative pagecaching is the minimum of these three values (1 minute).~~

~~## <iscache> Element~~
~~If you add multiple <iscache> elements in your template (or in locally included templates), one element takes precedence over the others. If an element turns caching off, it’s given precedence over the other elements. Otherwise, the element with the shortest cache time is given precedence. In general, when there are multiple <iscache> elements, the most restrictive one wins.~~

## Page Caching
In essence, the page cache is a key value store. The key is the full URL including query string and the value is the cached page. The page can contain markers for remote includes that are resolved the same way. The high-level processing logic is as follows.

1. The request is made.
2. Check if the cache entry for the given request path exists.
   * If Yes: Use the cached response and continue with processing remote includes. For each remote include, start at 1.
   * If No:
      1. Call the application layer to obtain a response.
      2. Check if the response is marked for caching. If yes, save in the page cache.
      3. Return the response.
   
Two APIs can control the caching behavior of the response.
- the `dw.system.Response#setExpires(milliseconds)` script API
- the `<iscache>` tag

Note: SFRA provides decorators that you can use instead of 1. The decorators apply to preconfigured caching times. Historically, the ISML tag was the only option, and the script API was introduced later. As a best practice, we strongly recommend discontinuing usage of the ISML tag, and leveraging the script API instead. Both approaches control the caching of the entire response, not individual templates. Although both APIs have the same effect, using the script API is recommended for a number of reasons.

By using the script API, you define the caching behavior in the controller and avoid some of the challenges of the ISML tag. For example, using the `<iscache>` tag can be confusing, as it might suggest you're just caching a template. In addition, it’s often difficult to understand which template defines the caching behavior of a response, because they can be nested, and each template can have its own `<iscache>` tag. (If so, **the lowest defined cache time is applied.**) Finally, a template might be used in different contexts that require different cache policies, making the implementation even more complex.

```
// SFRA controller cached via decorator
server.get("Show", cache.applyDefaultCache, function (req, res, next) {});

// Set cache time directly at the response (doesn’t rely on SFRA)
response.setExpires(new Date().getTime() + durationInMinutes * 60 * 1000);

// Apply personalized caching
response.setVaryBy("price_promotion");

// Cache times don’t have to be constants. Let's get creative!
// Apply layered caching times by product availability levels
var availabilityModel = product.getAvailabilityModel();
if (availabilityModel.isOrderable(50)) {
  // Cache 5 days when >= 50 orderable
  response.setExpires(new Date().getTime() + 120 * 60 * 60 * 1000);
} else if (availabilityModel.isOrderable(20)) {
  // Cache 1 day when >= 20 orderable
  response.setExpires(new Date().getTime() + 24 * 60 * 60 * 1000);
} else if (availabilityModel.isOrderable(5)) {
  // Cache 4 hours when >= 5 orderable
  response.setExpires(new Date().getTime() + 4 * 60 * 60 * 1000);
} else {
  // Cache 30 minutes when < 5 orderable
  response.setExpires(new Date().getTime() + 30 * 60 * 1000);
}
```

## Application Level Caching

### Request Caching
To save information within a single request, you can store data inside a module. In case the data is required again, this approach keeps its state. You save the data in the request with the additional logic attached. If your use case is to store just a small piece of data, you can use request.custom to save and read the information.

### Custom Objects 
Custom objects are very versatile. You can import and export custom objects. You can both write to and read them, and custom objects are persistent and consistent across all application servers. Common use cases for using custom objects include a scenario where the cached data must not get lost, or when a custom object acts as intermediate storage for data that’s processed later. The downside of custom objects is that they're stored in the database, and therefore, all architectural tiers are traversed.

### Custom Caches
Custom caches enable developers to store a limited amount of information. Because they aren’t shared across application servers, the data isn’t synchronized. Use custom caches to save intermediate results of expensive operations that must happen within dynamic requests, or operations that happen frequently.

### File Caches
File caches are great for build-time optimizations. Use file caches, for example:
 - To generate templates (in scenarios where template languages other than ISML are used)
 - To optimize development code
 - To create environment-specific configurations

### Session
If you want to cache smaller pieces of information for a shopper, consider using a session. Sessions are easy to implement, and you can use the data for building dynamic customer groups. You can use the following options to store data in a session.

- Use `session.custom` when data is used for building dynamic customer groups. When data is stored in `session.custom`, the platform updates the dynamic customer groups. Use this option sparingly, as it can consume many system resources.
- Use `session.privacy` when data isn’t used for building dynamic customer groups. This option doesn’t trigger customer group updates, and consumes fewer resources. The data is cleared out after logout.

## Caching Checklist
1. Always remember that the key difference between **local** and **remote** includes is that remote includes on a page have their own cache duration while local includes on a page will default to the include with the lowest cache duration.
2. Review the Technical tab of Reports and Dashboards for up-to-date cache hit ratios on all your pipelines/controllers. Aim for at least a **70% cache hit ratio**, above 90% is better.
3. While it is important to strive for high cache usage for all pages, it is also imperative that you do not cache certain pages. Such pages are best tucked away inside a remote include with its own cache time (e.g. minicart). Account and checkout pages should not be cached since they contain personally identifiable information (PII).
4. Use cache partitions to clear up the cache for specific pipelines/controllers instead of invalidating the whole cache.
5. When possible, use HTTP GET rather than POST for form submissions with cached results. The POST form method bypasses the page cache all together and makes a server-side call.
6. Use remote includes to build partial pages where page data is not likely to change (i.e. - product hit tiles).
7. Do not use more than 20 remote include sections on a single template page.
8. Limit the depth of remote includes to anywhere from 3 to 7, with the lower the better rule of thumb.
9. Cache the refinement panel using a remote include so that the site can serve the panel from cache in cases where multiple refinements are being used.
10. Use caution before any manual cache clears.
11. Regarding URL diversity and to increase the cache hit rate of a pipeline make sure:
    * All flows are leading to a caching instruction,
    * don't specify parameter names without corresponding parameter values,
    * to sort parameter names by alphabetical order,
    * to remove unique parameter names/values (shopper’s specific parameters can be handled via the session/cookie),
    * to minimize the overall length of the URL so as to speed up lookup times.