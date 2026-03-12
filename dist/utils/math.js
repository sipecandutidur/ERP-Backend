"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bankersRound = bankersRound;
const decimal_js_1 = __importDefault(require("decimal.js"));
/**
 * Banker's Rounding (Round half to even).
 * Rounds a number to the nearest integer. If the fractional part is exactly 0.5,
 * it rounds to the nearest even integer.
 *
 * @param value The number to round
 * @returns The rounded number
 */
function bankersRound(value) {
    if (value === null || value === undefined)
        return 0;
    // Use Decimal.ROUND_HALF_EVEN mode
    const decimalValue = new decimal_js_1.default(value);
    return decimalValue.toDecimalPlaces(0, decimal_js_1.default.ROUND_HALF_EVEN).toNumber();
}
