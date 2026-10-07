<?php

declare(strict_types=1);

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

/**
 * Runs every seeder needed for a working install.
 *
 * Usage: php spark db:seed DatabaseSeeder
 */
class DatabaseSeeder extends Seeder
{
    /**
     * Seeds reference data.
     */
    public function run(): void
    {
        $this->call(PracticeQuestionSeeder::class);
    }
}
