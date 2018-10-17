/* Script that contains shared functions that are useful in both content and background scripts. */

/** Picks certain properties from an object, discarding the rest. 
 * @param {string[]} props */
function pick(obj, props) {
	let newObj = {};
	props.forEach(prop => newObj[prop] = obj[prop]);
	return newObj;
}