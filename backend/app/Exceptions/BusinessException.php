<?php

namespace App\Exceptions;

use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * A rule violation the operator can understand and fix (duplicate entry, locked bill, …).
 * The message is a translation key from lang/{locale}/errors.php.
 */
class BusinessException extends HttpException
{
    public function __construct(
        public readonly string $errorCode,
        int $status = 422,
        public readonly array $context = [],
        public readonly array $replace = [],
    ) {
        parent::__construct($status, $errorCode);
    }

    public function userMessage(): string
    {
        return __("errors.{$this->errorCode}", $this->replace);
    }
}
