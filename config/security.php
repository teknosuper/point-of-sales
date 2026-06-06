<?php

return [
    'auth' => [
        'public_registration' => env('AUTH_PUBLIC_REGISTRATION', false),
        'registration_default_role' => env('AUTH_REGISTRATION_DEFAULT_ROLE', ''),
        'register_throttle' => env('AUTH_REGISTER_THROTTLE', '3,10'),
        'forgot_password_throttle' => env('AUTH_FORGOT_PASSWORD_THROTTLE', '5,10'),
    ],
    'bot_guard' => [
        'enabled' => env('SECURITY_BOT_GUARD_ENABLED', true),
        'honeypot_field' => env('SECURITY_BOT_GUARD_HONEYPOT_FIELD', 'company_website'),
        'token_field' => env('SECURITY_BOT_GUARD_TOKEN_FIELD', 'bot_guard_token'),
        'min_submit_seconds' => (int) env('SECURITY_BOT_GUARD_MIN_SUBMIT_SECONDS', 2),
        'token_ttl_seconds' => (int) env('SECURITY_BOT_GUARD_TOKEN_TTL_SECONDS', 1800),
        'message' => env('SECURITY_BOT_GUARD_MESSAGE', 'Permintaan tidak valid. Silakan coba lagi.'),
    ],
    'session' => [
        'absolute_lifetime_seconds' => (int) env('SECURITY_SESSION_ABSOLUTE_LIFETIME_SECONDS', 43200),
    ],
    'step_up' => [
        'recent_password_timeout' => (int) env('AUTH_PASSWORD_TIMEOUT', 900),
    ],
];
