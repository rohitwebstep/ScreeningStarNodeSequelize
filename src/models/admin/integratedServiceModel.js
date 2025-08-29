const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const Service = {
  create: async (type, data, admin_id, callback) => {
    try {
      const insertServiceSql = `
      INSERT INTO \`integration_services\` (\`type\`, \`data\`)
      VALUES (?, ?)
    `;

      const results = await sequelize.query(insertServiceSql, {
        replacements: [type, data], // Positional replacements
        type: QueryTypes.INSERT,
      });

      callback(null, results);
    } catch (err) {
      callback(err, null);
    }
  },

  list: async (callback) => {
    const sql = `
      SELECT 
        *
      FROM \`integration_services\`
    `;

    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });

    callback(null, results);
  },

  getIntegratedServiceById: async (id, callback) => {
    const sql = `SELECT * FROM \`integration_services\` WHERE \`id\` = ?`;
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, results[0]);
  },

  update: async (
    id,
    type,
    data,
    callback
  ) => {
    const sql = `
      UPDATE \`integration_services\`
      SET \`type\` = ?, \`data\` = ?
      WHERE \`id\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [type, data, id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, results);
  },

  delete: async (id, callback) => {
    const sql = `
      DELETE FROM \`integration_services\`
      WHERE \`id\` = ?
    `;

    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.DELETE,
    });
    callback(null, results);
  },
};

module.exports = Service;
