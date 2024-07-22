# Calendar Date Conversion

When converting Date to Calendar, the given Date object is always interpreted in the time zone GMT. This means time zone information at the the calendar object needs to be set separately by using the `setTimeZone(String)` method

When converting Calendar to Date, the `getTime()` method always retuns a Date object intepreted in the time zone GMT. The time zone information set at the calendar object won't be honored and gets lost.