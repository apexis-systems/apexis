'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    // 1. Drop foreign key constraint first
    await queryInterface.sequelize.query(`
      ALTER TABLE "files" DROP CONSTRAINT IF EXISTS "files_assigned_to_fkey";
    `);
    
    // 2. Change column type from INTEGER to INTEGER[]
    await queryInterface.sequelize.query(`
      ALTER TABLE "files" ALTER COLUMN "assigned_to" TYPE INTEGER[] USING 
        CASE 
          WHEN "assigned_to" IS NULL THEN NULL 
          ELSE ARRAY["assigned_to"] 
        END;
    `);
  },

  async down(queryInterface, Sequelize) {
    // 1. Convert assigned_to back to INTEGER
    await queryInterface.sequelize.query(`
      ALTER TABLE "files" ALTER COLUMN "assigned_to" TYPE INTEGER USING 
        CASE 
          WHEN "assigned_to" IS NULL THEN NULL 
          WHEN array_length("assigned_to", 1) = 0 THEN NULL
          ELSE "assigned_to"[1] 
        END;
    `);
    
    // 2. Add constraint back
    await queryInterface.sequelize.query(`
      ALTER TABLE "files" ADD CONSTRAINT "files_assigned_to_fkey" 
        FOREIGN KEY ("assigned_to") REFERENCES "users" ("id") ON UPDATE CASCADE ON DELETE SET NULL;
    `);
  }
};
