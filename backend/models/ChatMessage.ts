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
                allowNull: false,
            },
            type: {
                type: DataTypes.ENUM('text', 'image', 'system'),
                defaultValue: 'text',
            },
            seen: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
        },
        {
            tableName: "chat_messages",
            timestamps: true,
        }
    );

    return ChatMessage;
};
