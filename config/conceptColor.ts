/**
 * A colour a concept stores: hex, with or without alpha — #rgb, #rgba,
 * #rrggbb or #rrggbbaa — so the OKLCH picker's alpha strip can be used.
 * One rule for elements, tables, tabs and shadows alike.
 */
export const CONCEPT_HEX = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;
