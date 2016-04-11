var util = {};

/**
 * @name          stringify
 *
 * @description   This method will convert the given value into a string.
 *
 * @param         {Object|String} value
 *
 * @returns       {String}
 */

util.stringify = function stringify(value) {

	if(typeof value == 'string'){
		return value;
	}else if(typeof value == 'object'){
		return JSON.stringify(value);
	}

};

module.exports = util;