<?php

namespace App\Support;

/**
 * Exact decimal arithmetic for money and quantities (bcmath, half-up rounding).
 * Floats are never used for persisted amounts.
 */
final class Decimal
{
    public static function mul(string|int|float|null $a, string|int|float|null $b, int $scale = 2): string
    {
        return self::round(bcmul(self::str($a), self::str($b), $scale + 4), $scale);
    }

    public static function add(string|int|float|null $a, string|int|float|null $b, int $scale = 2): string
    {
        return bcadd(self::str($a), self::str($b), $scale);
    }

    public static function sub(string|int|float|null $a, string|int|float|null $b, int $scale = 2): string
    {
        return bcsub(self::str($a), self::str($b), $scale);
    }

    public static function div(string|int|float|null $a, string|int|float|null $b, int $scale = 2): string
    {
        if (bccomp(self::str($b), '0', 8) === 0) {
            return self::round('0', $scale);
        }

        return self::round(bcdiv(self::str($a), self::str($b), $scale + 4), $scale);
    }

    public static function cmp(string|int|float|null $a, string|int|float|null $b, int $scale = 2): int
    {
        return bccomp(self::str($a), self::str($b), $scale);
    }

    public static function max(string|int|float|null $a, string|int|float|null $b, int $scale = 2): string
    {
        return self::cmp($a, $b, $scale) >= 0 ? self::round($a, $scale) : self::round($b, $scale);
    }

    /** Half-up rounding (away from zero) to $scale decimals. */
    public static function round(string|int|float|null $value, int $scale = 2): string
    {
        $value = self::str($value);
        $offset = '0.'.str_repeat('0', $scale).'5';
        $offset = $scale === 0 ? '0.5' : $offset;

        return str_starts_with($value, '-')
            ? bcsub($value, $offset, $scale)
            : bcadd($value, $offset, $scale);
    }

    public static function str(string|int|float|null $value): string
    {
        if ($value === null || $value === '') {
            return '0';
        }

        if (is_float($value)) {
            // Avoid scientific notation and binary noise from floats.
            return rtrim(rtrim(number_format($value, 8, '.', ''), '0'), '.') ?: '0';
        }

        return (string) $value;
    }
}
