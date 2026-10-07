<?php

declare(strict_types=1);

namespace App\Database;

use CodeIgniter\Database\Migration;
use CodeIgniter\Database\RawSql;

/**
 * Shared column definitions and table options for Archie Learn migrations.
 *
 * Conventions (Aptiv manifesto §6):
 *  - InnoDB, utf8mb4 / utf8mb4_unicode_ci on every table
 *  - BIGINT UNSIGNED AUTO_INCREMENT primary keys
 *  - created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NULL
 *
 * Exception: columns that reference Shield's `users.id` are INT(11) UNSIGNED, because
 * Shield creates `users.id` as INT(11) UNSIGNED and MySQL requires FK column types to match.
 */
abstract class ArchieMigration extends Migration
{
    /**
     * Table options applied to every CREATE TABLE.
     */
    protected const TABLE_ATTRIBUTES = [
        'ENGINE'          => 'InnoDB',
        'DEFAULT CHARSET' => 'utf8mb4',
        'COLLATE'         => 'utf8mb4_unicode_ci',
    ];

    /**
     * BIGINT UNSIGNED AUTO_INCREMENT primary key definition.
     *
     * @return array<string, array<string, mixed>>
     */
    protected function idField(): array
    {
        return ['id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true]];
    }

    /**
     * Column type matching Shield's users.id (INT(11) UNSIGNED).
     *
     * @param bool $nullable Whether the column may be NULL
     * @return array<string, mixed>
     */
    protected function userIdColumn(bool $nullable = false): array
    {
        return ['type' => 'INT', 'constraint' => 11, 'unsigned' => true, 'null' => $nullable];
    }

    /**
     * BIGINT UNSIGNED column for FKs to our own tables.
     *
     * @param bool $nullable Whether the column may be NULL
     * @return array<string, mixed>
     */
    protected function bigFkColumn(bool $nullable = false): array
    {
        return ['type' => 'BIGINT', 'unsigned' => true, 'null' => $nullable];
    }

    /**
     * created_at / updated_at columns.
     *
     * @return array<string, array<string, mixed>>
     */
    protected function timestampFields(): array
    {
        return [
            'created_at' => ['type' => 'DATETIME', 'null' => false, 'default' => new RawSql('CURRENT_TIMESTAMP')],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ];
    }

    /**
     * Creates the table with the standard InnoDB/utf8mb4 attributes.
     *
     * @param string $table Table name
     */
    protected function createStandardTable(string $table): void
    {
        $this->forge->createTable($table, true, self::TABLE_ATTRIBUTES);
    }
}
