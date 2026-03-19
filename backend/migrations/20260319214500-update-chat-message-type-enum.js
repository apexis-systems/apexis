'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
    up: async (queryInterface, Sequelize) => {
        // For PostgreSQL, we need to add the value to the existing ENUM type
        // If it's not PostgreSQL, we might need a different approach, 
        // but the error "routine: 'enum_in'" is very characteristic of Postgres.
        try {
            await queryInterface.sequelize.query('ALTER TYPE "enum_chat_messages_type" ADD VALUE IF NOT EXISTS \'file\'');
        } catch (error) {
            console.warn('Wait, maybe not Postgres or ENUM name differs. Trying changeColumn.');
            // Fallback: try to change the column definition
            await queryInterface.changeColumn('chat_messages', 'type', {
                type: Sequelize.ENUM('text', 'image', 'file', 'system'),
                defaultValue: 'text',
                allowNull: false,
            });
        }
    },

    down: async (queryInterface, Sequelize) => {
        // Removing a value from an ENUM is hard in Postgres. 
        // Usually we just leave it or revert the column definition.
        await queryInterface.changeColumn('chat_messages', 'type', {
            type: Sequelize.ENUM('text', 'image', 'system'),
            defaultValue: 'text',
            allowNull: false,
        });
    }
};
