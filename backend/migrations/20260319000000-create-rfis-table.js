'use strict';

export default {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('rfis', {
            id: {
                type: Sequelize.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            project_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'projects', key: 'id' },
                onDelete: 'CASCADE',
            },
            title: {
                type: Sequelize.STRING(200),
                allowNull: false
            },
            description: {
                type: Sequelize.TEXT
            },
            status: {
                type: Sequelize.STRING(20),
                defaultValue: 'open' // open | closed | overdue
            },
            assigned_to: {
                type: Sequelize.INTEGER,
                references: { model: 'users', key: 'id' }
            },
            created_by: {
                type: Sequelize.INTEGER,
                references: { model: 'users', key: 'id' }
            },
            is_client_visible: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
            },
            photos: {
                type: Sequelize.JSON,
                allowNull: true
            },
            createdAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('NOW()')
            },
            updatedAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('NOW()')
            },
        });
        await queryInterface.addIndex('rfis', ['project_id']);
    },
    down: async (queryInterface) => {
        await queryInterface.dropTable('rfis');
    },
};
