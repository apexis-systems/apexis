import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const ChatMessage = sequelize.define(
        "chat_messages",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            room_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            sender_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            text: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            type: {
                type: DataTypes.ENUM('text', 'image', 'file', 'system'),
                defaultValue: 'text',
            },
            file_url: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            file_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            file_type: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            file_size: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            seen: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            parent_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'chat_messages',
                    key: 'id'
                }
            },
        },
        {
            tableName: "chat_messages",
            timestamps: true,
        }
    );

    return ChatMessage;
};
