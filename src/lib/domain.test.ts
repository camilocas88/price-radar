import { describe, expect, it } from "vitest";
import { normalizeProduct } from "./normalize";
import { calculateRealPrice } from "./price";
import { trustScore } from "./trust";
describe("precio real",()=>it("suma producto, envío e impuestos",()=>expect(calculateRealPrice({amount:100,currency:"USD",exchangeRate:4000,shipping:20000,taxes:80000})).toMatchObject({total:500000,estimated:false})));
describe("normalización",()=>it("extrae iPhone y capacidad",()=>expect(normalizeProduct("iPhone 17 Pro Max 256 GB negro")).toMatchObject({brand:"Apple",storage:"256 GB",condition:"nuevo"})));
describe("confianza",()=>it("penaliza una oferta atípica e incompleta",()=>expect(trustScore({reputation:60,protectedPayment:false,localWarranty:false,checkout:false,atypicalPrice:true,complete:false,reviews:false})).toBe(20)));
