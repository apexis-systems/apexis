import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const ConversationMessage = sequelize.define(
        "conversation_messages",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            item_type: {
                type: DataTypes.ENUM("rfi", "snag"),
                allowNull: false,
            },
            item_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            project_id: {
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
            attachment_type: {
                type: DataTypes.ENUM("image", "audio"),
                allowNull: true,
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
        },
        {
            tableName: "conversation_messages",
            timestamps: true,
        }
    );

    return ConversationMessage;
};
