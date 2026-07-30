import { Transform } from 'class-transformer';

/**
 * Parses query-string booleans safely.
 *
 * Avoids the NestJS/class-transformer trap where
 * enableImplicitConversion turns the string "false" into true
 * via Boolean("false") === true.
 *
 * Reads the raw value from the source object so we always see
 * the original query string ("true" / "false"), not a coerced boolean.
 */
export function ToBooleanQuery(defaultValue = false) {
  return Transform(({ obj, key }) => {
    const raw = obj?.[key];

    if (raw === undefined || raw === null || raw === '') {
      return defaultValue;
    }

    if (raw === true || raw === 'true' || raw === 1 || raw === '1') {
      return true;
    }

    if (raw === false || raw === 'false' || raw === 0 || raw === '0') {
      return false;
    }

    return defaultValue;
  });
}
