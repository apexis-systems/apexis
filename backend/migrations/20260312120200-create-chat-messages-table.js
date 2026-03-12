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
                onDelete: 'SET NULL'
            },
            text: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            type: {
                type: Sequelize.ENUM('text', 'image', 'system'),
                defaultValue: 'text',
                allowNull: false,
            },
            seen: {
                type: Sequelize.BOOLEAN,
                defaultValue: false
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
