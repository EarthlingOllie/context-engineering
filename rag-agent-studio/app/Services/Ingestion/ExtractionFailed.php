<?php

namespace App\Services\Ingestion;

use RuntimeException;

/** Thrown with a plain-English message when a source cannot be read. */
class ExtractionFailed extends RuntimeException {}
