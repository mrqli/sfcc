# JQuery in ISML Templates

Some integrations need to inject Javascript to ISML template. When there is `#` in the javascript, it needs to take extra care.
`var u=/[?&](?:callback|cb)=([^&${'#'}]+)/`
![jQuery in ISML](screenshots/jQuery%20in%20ISML.png)

jQuery is frequently used in ISML templates. B2C Commerce supports versions up to and including jQuery 1.3.2.<br>

Avoid using the # character in jQuery or JavaScript because it's reserved in ISML templates and can cause problems.<br>
```html
<a id="id-to-select" href="...">...</a>

<script type="text/javascript">
jQuery("#id-to-select").click(function() {
    // Code here
});
</script>
```
Use the following code:
```html
<script type="text/javascript">
jQuery("a[id='id-to-select']").click(function() {
    // Code here
});
</script>
```
Alternatively, the following notation:
`<a href="#">Link</a>`
is correctly written in ISML as
`<a href="${'#'}">Link</a>`
