<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use App\Database\ArchieMigration;

/**
 * Creates the `profiles` table.
 */
class CreateProfilesTable extends ArchieMigration
{
    /**
     * Applies the migration.
     */
    public function up(): void
    {
        $this->forge->addField($this->idField() + [
            'user_id'         => $this->userIdColumn(),
            'email'           => ['type' => 'VARCHAR', 'constraint' => 254],
            'role'            => ['type' => 'VARCHAR', 'constraint' => 10, 'default' => 'student'],
            'first_name'      => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => true],
            'last_name'       => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => true],
            'grade'           => ['type' => 'TINYINT', 'unsigned' => true, 'null' => true],
            'primary_subject' => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => true],
            'subjects'        => ['type' => 'JSON', 'null' => true],
            'school'          => ['type' => 'VARCHAR', 'constraint' => 150, 'null' => true],
            'dob'             => ['type' => 'DATE', 'null' => true],
            'companion'       => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
        ] + $this->timestampFields());
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('user_id');
        $this->forge->addKey('role');
        $this->forge->addKey('created_at');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE', 'fk_profiles_user');
        $this->createStandardTable('profiles');
    }

    /**
     * Reverts the migration.
     */
    public function down(): void
    {
        $this->forge->dropTable('profiles', true);
    }
}
