/**
 * xlfin.js
 * https://github.com/djhaley/xlfin
 *
 * A JavaScript library providing the capabilities of Excel's financial functions.
 *
 * @version 0.1
 * @date    2015-02-01
 *
 * @license
 * Copyright (C) 2015 Dan Haley
 *
 * xlfin.js is licensed under:
 * * The Apache 2.0 License
 *   http://www.apache.org/licenses/LICENSE-2.0
 * xlfin.js may be distributed under this license.
 *
 * Portions of this library are a recreation of the F# Excel Financial Functions
 * library located at https://github.com/fsprojects/ExcelFinancialFunctions.  The
 * F# Excel Financial Functions library is also licensed under the Apache 2.0 License.
 */
; (function () {
	var xlfin,
		supportedProps = ["pv", "rate", "nper", "pmt"],
		initialize, dom, util;

	initialize = function () {
		var fins = dom.get("[data-fin]");

		// search the dom and bind what we find
		[].forEach.call(fins, function (elem) {
			var finParams; // parameters passed in data-fin attribute

			finParams = elem.getAttribute("data-fin").split(",").reduce(function (prev, current) {
				prev[current.split(":")[0].trim()] = current.split(":")[1].trim();
				return prev;
			}, {});

			if (finParams.input && supportedProps.indexOf(finParams.input) >= 0) {
				input(elem, finParams);
			}
			if (finParams.output && supportedProps.indexOf(finParams.output) >= 0) {
				output(elem, finParams);
			}
		});
	};

	// input/output handlers
	function input(element, params) {
		var property = params.input,
			factor = params.factor ? parseFloat(params.factor) : 1,
			invfactor = params.invfactor ? parseFloat(params.invfactor) : 1,
			formula = params.formula || "default",
			ev;

		// bind to the change event on the element - only supporting input type='text' currently
		if (util.exists(element.addEventListener)) {
			element.addEventListener("change", function () {
				var newVal = parseFloat(element.value);
				newVal = (isNaN(newVal) ? 0 : newVal) * factor / invfactor;
				util.pubsub.publish(formula, [{ propertyChanged: property, newValue: newVal }]);
			}, false);
		}

		element.disabled = false;

		if (params.default) {
			element.value = params.default;
			ev = document.createEvent("Event");
			ev.initEvent("change", true, false);
			element.dispatchEvent(ev);
		}
	}

	function output(element, params) {
		var formula = params.formula || "default",
			pv = params.pv ? parseFloat(params.pv) : null,
			rate = params.rate ? parseFloat(params.rate) : null,
			nper = params.nper ? parseFloat(params.nper) : null,
			pmt = params.pmt ? parseFloat(params.pmt) : null,
			factor = params.factor ? parseFloat(params.factor) : 1,
			invfactor = params.invfactor ? parseFloat(params.invfactor) : 1,
			recalculate = function () { return "Invalid output type"; };

		switch (params.output) {
			case "pmt":
				recalculate = function() {
					if (util.exists([pv, nper, rate])) {
						try { element.innerText = util.format(xlfin.Pmt(rate, nper, -pv) * factor / invfactor, 2, true); } catch(e) { element.innerText = "N/A"; }
					} else {
						element.innerText = "N/A";
					}
				};
				break;
			case "nper":
				recalculate = function () {
					if (util.exists([rate, pmt, pv])) {
						try { element.innerText = util.format(xlfin.NPer(rate, pmt, -pv) * factor / invfactor, 2); } catch (e) { element.innerText = "N/A"; }
					} else {
						element.innerText = "N/A";
					}
				}
				break;
			case "rate":
				recalculate = function () {
					if (util.exists([nper, pmt, pv])) {
						try { element.innerText = util.format(xlfin.Rate(nper, pmt, -pv) * factor / invfactor, 2); } catch (e) { element.innerText = "N/A"; }
					} else {
						element.innerText = "N/A";
					}
				}
				break;
			case "pv":
				recalculate = function () {
					if (util.exists([nper, pmt, rate])) {
						try { element.innerText = util.format(xlfin.Pv(rate, nper, pmt) * factor / invfactor, 2); } catch (e) { element.innerText = "N/A"; }
					} else {
						element.innerText = "N/A";
					}
				}
				break;
		}

		util.pubsub.subscribe(formula, function (messages) {
				messages.forEach(function (m) {
					if (m.propertyChanged) {
						if (m.propertyChanged === "pv") pv = parseFloat(m.newValue);
						if (m.propertyChanged === "rate") rate = parseFloat(m.newValue);
						if (m.propertyChanged === "nper") nper = parseFloat(m.newValue);
						if (m.propertyChanged === "pmt") pmt = parseFloat(m.newValue);
						recalculate();
					}
				});
			}, true);
	}

	// helper methods
	dom = {
		get: function (selector) {
			return document.querySelectorAll(selector);
		},
		id: function (id) {
			return document.getElementById(id);
		}
	};

	util = {
		exists: function (obj) {
			if (Array.isArray(obj)) {
				return obj.every(function (val) { return val !== null && val !== undefined; });
			} else {
				return obj !== null && obj !== undefined;
			}
		},
		format: function(val, decimals, ts) {
			var decSep = Number("1.2").toLocaleString().substr(1, 1),
				withCommas = (ts ? val.toLocaleString() : val),
				valParts = String(withCommas).split(decSep),
				intPart = valParts[0],
				decPart = (valParts.length > 1 ? valParts[1] : "");

			decimals = (decimals === null || decimals === undefined) ? 0 : decimals;
			decPart = (decPart + "00").substr(0, decimals);
			return intPart + (decPart.length > 0 ? (decSep + decPart) : "");
		},
		pubsub: (function() {
			var callbacks = {},
				history = {},
				publish = function (topic, data) {
					if (!history[topic]) history[topic] = [];
					history[topic].push(data);
					if (callbacks[topic]) callbacks[topic].forEach(function (c) { c(data); });
					return this;
				},
				subscribe = function (topic, func, useHistory) {
					if (!callbacks[topic]) callbacks[topic] = [];
					callbacks[topic].push(func);
					if (useHistory && history[topic]) { history[topic].forEach(function (h) { func(h); }); }
					return this;
				},
				unsubscribe = function(topic, func) {
					var idx = null;
					if (callbacks[topic]) idx = callbacks[topic].indexOf(func);
					if (idx) callbacks[topic].splice(idx, 1);
					return this;
				};
			return {
				publish: publish,
				subscribe: subscribe,
				unsubscribe: unsubscribe
			};
		})()
	};

	xlfin = (function () {
		var
		messages = {
			invalidArguments: "Error in supplied arguments."
		},
		paymentDue = {
			EndOfPeriod: 0,
			BeginningOfPeriod: 1
		},

		annuityCertainFvFactor, annuityCertainPvFactor,
		calcFv, calcNper, calcPv, calcRate, calcPmt,
		fv, fvFactor,
		nper, nperFactor,
		pmt, pv, pvFactor,

		bisection, findBounds, findRoot, newton,

		sign, isFloat, isInteger;

		// supporting financial functions
		annuityCertainFvFactor = function (r, nper, pd) {
			return annuityCertainPvFactor(r, nper, pd) * fvFactor(r, nper);
		};

		annuityCertainPvFactor = function (r, nper, pd) {
			if (r === 0) return nper;
			return (1 + (r * pd)) * (1 - pvFactor(r, nper)) / r;
		};

		calcFv = function (r, nper, pmt, pv, pd) {
			if (r < -1 && !isInteger(nper)) throw messages.invalidArguments;
			if (r === -1 && nper < 0) throw messages.invalidArguments;
			if (pmt === 0 && pv === 0) throw messages.invalidArguments;

			if (r === -1 && pd === paymentDue.BeginningOfPeriod) return -(pv * fvFactor(r, nper));
			if (r === -1 && pd === paymentDue.EndOfPeriod) return -(pv * fvFactor(r, nper) + pmt);
			return fv(r, nper, pmt, pv, pd);
		};

		calcNper = function (r, pmt, pv, fv, pd) {
			if (r === 0 && pmt !== 0) return -(fv + pv) / pmt;
			return nper(r, pmt, pv, fv, pd);
		};

		calcPmt = function (r, nper, pv, fv, pd) {
			if (r < -1 && !isInteger(nper)) throw messages.invalidArguments;
			if (fv === 0 && pv === 0) throw messages.invalidArguments;
			if (r === -1 && (nper === 0 || pd === paymentDue.BeginningOfPeriod)) throw messages.invalidArguments;
			if (annuityCertainPvFactor(r, nper, pd) === 0) throw messages.invalidArguments;

			if (r === -1) return -fv;
			return pmt(r, nper, pv, fv, pd);
		};

		calcPv = function (r, nper, pmt, fv, pd) {
			if (r < -1 && !isInteger(nper)) throw messages.invalidArguments;
			if (pmt === 0 && fv === 0) throw messages.invalidArguments;
			if (r === -1) throw messages.invalidArguments;

			return pv(r, nper, pmt, fv, pd);
		};

		calcRate = function (nper, pmt, pv, fv, pd, guess) {
			if ((pmt === 0 && pv === 0) || nper === 0) throw messages.invalidArguments;

			if ((sign(pmt) === sign(pv) && sign(pv) === sign(fv)) ||
				(sign(pmt) === sign(pv) && fv === 0) || (sign(pmt) === sign(fv) && pv === 0) || (sign(pv) === sign(fv) && pmt === 0))
				throw messages.invalidArguments;

			if (fv === 0 && pv === 0) return pmt < 0 ? -1 : 1;

			return findRoot(function (r) {
				return calcFv(r, nper, pmt, pv, pd) - fv;
			}, guess);
		};

		fv = function (r, nper, pmt, pv, pd) {
			return -((pv * fvFactor(r, nper)) + (pmt * annuityCertainFvFactor(r, nper, pd)));
		};

		fvFactor = function (r, nper) {
			return Math.pow((1 + r), nper);
		};

		nper = function (r, pmt, pv, fv, pd) {
			return Math.log(nperFactor(r, pmt, -fv, pd) / nperFactor(r, pmt, pv, pd)) / Math.log(r + 1);
		};

		nperFactor = function (r, pmt, v, pd) {
			return v * r + pmt * (1 + r * pd);
		};

		pmt = function (r, nper, pv, fv, pd) {
			return -(pv + fv * pvFactor(r, nper)) / annuityCertainPvFactor(r, nper, pd);
		};

		pv = function (r, nper, pmt, fv, pd) {
			return -(fv * pvFactor(r, nper) + pmt * annuityCertainPvFactor(r, nper, pd));
		};

		pvFactor = function (r, nper) {
			return 1 / fvFactor(r, nper);
		};

		// supporting algorithms
		bisection = function (f, a, b, precision) {
			var maxCount = 200,
				count = 0, fa, fb,
				helper;

			helper = function (a, b, fa, fb) {
				var midvalue, fmid;

				if (a === b) throw msg;

				count++;
				if (count > maxCount) throw "Error in bisection";
				if (fa * fb > 0) throw "Error in bisection";

				midvalue = a + 0.5 * (b - a);
				fmid = f(midvalue);

				if (Math.abs(fmid) < precision) return midvalue;
				if (fa * fmid < 0) return helper(a, midvalue, fa, fmid);
				if (fa * fmid > 0) return helper(midvalue, b, fmid, fb);
				throw "Error in bisection";
			}

			fa = f(a);
			if (Math.abs(fa) < precision) return a;

			fb = f(b);
			if (Math.abs(fb) < precision) return b;

			return helper(a, b, fa, fb);
		};

		findBounds = function (f, guess, minBound, maxBound, precision) {
			var shift, factor, maxTries, adjValueToMin, adjValueToMax, rfindBounds, lower, upper;
			if (guess <= minBound || guess >= maxBound) throw msg;

			shift = 0.01;
			factor = 1.6;
			maxTries = 60;
			adjValueToMin = function (value) { return (value <= minBound ? (minBound + precision) : value); };
			adjValueToMax = function (value) { return (value >= maxBound ? (maxBound - precision) : value); };
			rfindBounds = function (low, up, tries) {
				var fLow, fUp;

				tries = tries - 1;
				if (tries === 0) throw "findBounds gave up after 60 tries";
				lower = adjValueToMin(low);
				upper = adjValueToMax(up);
				fLow = f(lower);
				fUp = f(upper);
				if (fLow * fUp <= 0) return [lower, upper];
				if (fLow * fUp > 0) return rfindBounds(lower + factor * (lower - upper), upper + factor * (upper - lower), tries);
				throw "Error in findBounds";
			}
			return rfindBounds(adjValueToMin(guess - shift), adjValueToMax(guess + shift), maxTries);
		};

		findRoot = function (f, guess) {
			var precision = 0.0000001,
				newtValue = newton(f, guess, precision),
				bounds;
			if (newtValue !== null && sign(guess) === sign(newtValue)) return newtValue;

			bounds = findBounds(f, guess, -1.0, Number.MAX_VALUE, precision);
			return bisection(f, bounds[0], bounds[1], precision);
		};

		newton = function (f, x, precision) {
			var maxCount = 20,
				count = 0,
				fx, Fx, newX;

			while (count < maxCount) {
				fx = f(x);
				Fx = (f(x + precision) - f(x - precision)) / (2 * precision);
				newX = x - (fx / Fx);
				if (Math.abs(newX - x) < precision) break;
				else if (count === (maxCount - 1)) newX = null;
				x = newX;
				count++;
			}

			return x;
		};

		// utilities
		sign = function (x) {
			x = +x;
			if (x === 0 || isNaN(x)) return x
			return x > 0 ? 1 : -1
		};

		isFloat = function (n) {
			return n === +n && n !== (n | 0);
		};

		isInteger = function (n) {
			return n === +n && n === (n | 0);
		};

		return {
			NPer: function (rate, pmt, pv, fv, typ) {
				fv = fv || 0;
				typ = typ || paymentDue.EndOfPeriod;

				return calcNper(rate, pmt, pv, fv, typ);
			},
			Pmt: function (rate, nper, pv, fv, typ) {
				fv = fv || 0;
				typ = typ || paymentDue.EndOfPeriod;

				return calcPmt(rate, nper, pv, fv, typ);
			},
			Pv: function (rate, nper, pmt, fv, typ) {
				fv = fv || 0;
				typ = typ || paymentDue.EndOfPeriod;

				return calcPv(rate, nper, pmt, fv, typ);
			},
			Rate: function (nper, pmt, pv, fv, typ, guess) {
				fv = fv || 0;
				typ = typ || paymentDue.EndOfPeriod;
				guess = guess || 0.1;

				return calcRate(nper, pmt, pv, fv, typ, guess);
			},

			PaymentDue: paymentDue
		};
	})();

	if (!window.xlfin) {
		window.xlfin = xlfin;
		window.addEventListener("DOMContentLoaded", initialize, false);
	}
})();
