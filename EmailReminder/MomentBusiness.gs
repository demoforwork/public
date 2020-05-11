/**
 * @fileoverview Copy of https://github.com/kalmecak/moment-business-days plug-in
*/

/**
The MIT License (MIT)

Copyright (c) 2015 christian

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/**
 * momentjs-business.js
 * businessDiff (mStartDate)
 * businessAdd (numberOfDays)
 */
(function () {
  var moment;
  moment = (typeof require !== "undefined" && require !== null) &&
           !require.amd ? require("moment") : this.moment;

  moment.fn.businessDiff = function (param) {
    param = moment(param);
    var signal = param.unix() < this.unix()?1:-1;
    var start = moment.min(param, this).clone();
    var end = moment.max(param, this).clone();
    var start_offset = start.day() - 7;
    var end_offset = end.day();

    var end_sunday = end.clone().subtract('d', end_offset);
    var start_sunday = start.clone().subtract('d', start_offset);
    var weeks = end_sunday.diff(start_sunday, 'days') / 7;

    start_offset = Math.abs(start_offset);
    if(start_offset == 7)
      start_offset = 5;
    else if(start_offset == 1)
      start_offset = 0;
    else
      start_offset -= 2;


    if(end_offset == 6)
      end_offset--;

    return signal * (weeks * 5 + start_offset + end_offset);
  };

  moment.fn.businessAdd = function (days) {
    var signal = days<0?-1:1;
    days = Math.abs(days);
    var d = this.clone().add(Math.floor(days / 5) * 7 * signal, 'd');
    var remaining = days % 5;
    while(remaining){
      d.add(signal, 'd');
      if(d.day() !== 0 && d.day() !== 6)
        remaining--;
    }
    return d;
  };

  moment.fn.businessSubtract = function(days){
    return this.businessAdd(-days);
  };

}).call(this);