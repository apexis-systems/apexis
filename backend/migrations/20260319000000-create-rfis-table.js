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
                type: Sequelize.ENUM('open', 'closed', 'overdue'),
                allowNull: false,
                defaultValue: 'open'
            },
            assigned_to: {
                type: Sequelize.INTEGER,
                references: { model: 'users', key: 'id' }
            },
            created_by: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' }
            },
            is_client_visible: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            photos: {
                type: Sequelize.JSON,
                allowNull: true
            },
            expiry_date: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            response: {
                type: Sequelize.TEXT,
                allowNull: true,
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
