import assert from "node:assert/strict";
import test from "node:test";
import { irrToExactToman, parseIntegerAmount, toCanonicalIrr } from "../src/money.js";
test("converts Toman to canonical Rial exactly",()=>assert.equal(toCanonicalIrr("1250000","TOMAN").amountMinor,12500000n));
test("preserves Rial remainder in Toman display",()=>{assert.equal(irrToExactToman(11n),"1.1");assert.equal(irrToExactToman(-11n),"-1.1");});
test("preserves integers above Number.MAX_SAFE_INTEGER",()=>assert.equal(parseIntegerAmount("9007199254740993"),9007199254740993n));
test("rejects decimals, exponents, separators, and noncanonical integers",()=>{for(const value of ["1.5","1e6","1,000","01"," 1"])assert.throws(()=>parseIntegerAmount(value),TypeError);});
