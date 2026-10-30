<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Knowledge processing
    |--------------------------------------------------------------------------
    |
    | How source text is split before it is stored, and how much of it is
    | handed to the assistant when it answers. None of this is shown in the UI.
    |
    */

    'chunk_size' => 800,
    'chunk_overlap' => 150,
    'embed_batch' => 32,
    'top_k' => 6,
    'history_turns' => 10,
    'max_file_mb' => 10,

    /*
    |--------------------------------------------------------------------------
    | Providers
    |--------------------------------------------------------------------------
    |
    | Each provider has a "real" driver that talks to the outside service and
    | a "fake" driver used in tests and local demos.
    |
    */

    'answer_model' => env('STUDIO_ANSWER_MODEL', 'claude-sonnet-4-5'),
    'embedding_model' => env('STUDIO_EMBEDDING_MODEL', 'voyage-3'),

    'answer_driver' => env('STUDIO_ANSWER_DRIVER', 'fake'),
    'embedding_driver' => env('STUDIO_EMBEDDING_DRIVER', 'fake'),
    'url_fetch_driver' => env('STUDIO_URL_FETCH_DRIVER', 'fake'),

    'anthropic_api_key' => env('ANTHROPIC_API_KEY'),
    'voyage_api_key' => env('VOYAGE_API_KEY'),

];
