# Caching

## OCAPI Caching
OCAPI error response could be cached. If race conditions happen, this will result in incorrect responses in retries. Disabling OCAPI error response cache can be configured in BM.
For OCAPI, only GET calls can be cached. The Data API does not support caching at all. By default, GET responses that support caching are cached for 60 seconds. It is possible to override the default 60 seconds of caching of an resource by adding it to the OCAPI Settings in the Business Manager. You can set a maximum value of 86,400 seconds (1 day).

Currently, you can’t control the server-side cache times of SCAPI. 

## Page Caching
If different pagecache settings are supplied for different components of the page, the response takes on the shortest of the pagecache settings. For example, if you have a page where:

Component A has a 1-minute relative pagecaching.
Component B has a 1-hour relative pagecaching.
Component C has a 1-day relative pagecaching.
The final calculated relative pagecaching is the minimum of these three values (1 minute).

## <iscache> Element
If you add multiple <iscache> elements in your template (or in locally included templates), one element takes precedence over the others. If an element turns caching off, it’s given precedence over the other elements. Otherwise, the element with the shortest cache time is given precedence. In general, when there are multiple <iscache> elements, the most restrictive one wins.