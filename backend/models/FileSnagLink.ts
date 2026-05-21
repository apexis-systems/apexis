import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const FileSnagLink = sequelize.define(
        "file_snag_links",
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
            snag_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            }
        },
        {
            tableName: "file_snag_links",
            timestamps: true,
            paranoid: false,
        }
    );

    return FileSnagLink;
};
