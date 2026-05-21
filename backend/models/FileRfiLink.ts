import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const FileRfiLink = sequelize.define(
        "file_rfi_links",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            file_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            rfi_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            }
        },
        {
            tableName: "file_rfi_links",
            timestamps: true,
            paranoid: false,
        }
    );

    return FileRfiLink;
};
