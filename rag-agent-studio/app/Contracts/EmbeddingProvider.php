<?php

namespace App\Contracts;

interface EmbeddingProvider
{
    /**
     * Turn each text into a list of floats.
     *
     * @param  list<string>  $texts
     * @return list<list<float>>
     */
    public function embed(array $texts): array;
}
