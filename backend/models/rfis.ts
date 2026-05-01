import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const RFI = sequelize.define(
        "rfis",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            project_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            title: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            status: {
                type: DataTypes.ENUM("open", "closed", "overdue"),
                allowNull: false,
                defaultValue: "open",
            },
            assigned_to: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            created_by: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            is_client_visible: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            photos: {
                type: DataTypes.JSON,
                allowNull: true,
            },
            expiry_date: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            response: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            response_photos: {
                type: DataTypes.JSON,
                allowNull: true,
            },
            folder_ids: {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: [],
            },
        },
        {
            tableName: "rfis",
            timestamps: true,
        }
    );

    return RFI;
};
