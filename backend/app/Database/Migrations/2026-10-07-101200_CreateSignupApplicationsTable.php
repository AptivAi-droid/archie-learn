<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use App\Database\ArchieMigration;

/**
 * Creates the `signup_applications` table.
 */
class CreateSignupApplicationsTable extends ArchieMigration
{
    /**
     * Applies the migration.
     */
    public function up(): void
    {
        // password_hash holds the applicant's chosen password (hashed) only while the application
        // awaits admin review, so an approval can create the account. Cleared on decision.
        $this->forge->addField($this->idField() + [
            'email'            => ['type' => 'VARCHAR', 'constraint' => 254],
            'requested_role'   => ['type' => 'VARCHAR', 'constraint' => 10],
            'dob'              => ['type' => 'DATE'],
            'application_data' => ['type' => 'JSON'],
            'password_hash'    => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'status'           => ['type' => 'VARCHAR', 'constraint' => 15],
            'ai_decision'      => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => true],
            'ai_confidence'    => ['type' => 'DECIMAL', 'constraint' => '3,2', 'null' => true],
            'ai_reasoning'     => ['type' => 'TEXT', 'null' => true],
            'ai_red_flags'     => ['type' => 'JSON', 'null' => true],
            'admin_decision'   => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => true],
            'admin_notes'      => ['type' => 'TEXT', 'null' => true],
            'reviewed_by'      => $this->userIdColumn(true),
            'reviewed_at'      => ['type' => 'DATETIME', 'null' => true],
            'created_user_id'  => $this->userIdColumn(true),
            'ip_address'       => ['type' => 'VARCHAR', 'constraint' => 45, 'null' => true],
        ] + $this->timestampFields());
        $this->forge->addKey('id', true);
        $this->forge->addKey(['email', 'created_at']);
        $this->forge->addKey('status');
        $this->forge->addKey('created_at');
        $this->forge->addForeignKey('reviewed_by', 'users', 'id', 'CASCADE', 'SET NULL', 'fk_applications_reviewer');
        $this->forge->addForeignKey('created_user_id', 'users', 'id', 'CASCADE', 'SET NULL', 'fk_applications_user');
        $this->createStandardTable('signup_applications');
    }

    /**
     * Reverts the migration.
     */
    public function down(): void
    {
        $this->forge->dropTable('signup_applications', true);
    }
}
