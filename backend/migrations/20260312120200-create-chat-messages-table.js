'use strict';
export default {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('chat_messages', {
            id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
            room_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'rooms', key: 'id' },
                onDelete: 'CASCADE'
            },
            sender_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE'
            },
            text: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            type: {
                type: Sequelize.ENUM('text', 'image', 'file', 'system'),
                defaultValue: 'text',
                allowNull: false,
            },
            file_url: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            file_name: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            file_type: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            file_size: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            seen: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
            },
            parent_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'chat_messages', key: 'id' },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
            },
            createdAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
            updatedAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('now')
            },
        });
        await queryInterface.addIndex('chat_messages', ['room_id']);
    },
    down: async (queryInterface) => {
        await queryInterface.dropTable('chat_messages');
    },
};
