const University = require("../../../models/admin/internal-storage/universityModel");
const Common = require("../../../models/admin/commonModel");
const { getClientIpAddress } = require("../../../utils/ipAddress");

// Controller to create a new service
exports.create = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const {
        university_name,
        university_address,
        contact_name,
        designation,
        mobile_number,
        email_id,
        scope_of_services,
        pricing,
        turnaround_time,
        standard_process,
        verification_link,
        remark,
        admin_id,
        _token,
    } = req.body;

    let missingFields = [];
    const requiredFields = {
        admin_id: "Admin ID",
        _token: "Token",
    };

    for (let field in requiredFields) {
        if (!req.body[field] || (typeof req.body[field] === 'string' && req.body[field].trim() === "")) {
            missingFields.push(requiredFields[field]);
        }
    }

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    const action = "client_overview";
    Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
        if (!result.status) {
            // Check the status returned by the authorization function
            return res.status(403).json({
                status: false,
                message: result.message, // Return the message from the authorization function
            });
        }

        Common.isAdminTokenValid(_token, admin_id, (err, result) => {
            if (err) {
                console.error("Error checking token validity:", err);
                return res.status(500).json(err);
            }

            if (!result.status) {
                return res.status(401).json({ status: false, message: result.message });
            }
            University.create(
                university_name,
                university_address,
                contact_name,
                designation,
                mobile_number,
                email_id,
                scope_of_services,
                pricing,
                turnaround_time,
                standard_process,
                verification_link,
                remark,
                (err, result) => {
                    if (err) {
                        Common.adminActivityLog(
                            ipAddress,
                            ipType,
                            admin_id,
                            "Internal Storage/University",
                            "Create",
                            "0",
                            null,
                            err,
                            () => { }
                        );
                        console.error("Database error:", err);
                        return res.status(500).json({ status: false, message: err.message });
                    }
                    Common.adminActivityLog(
                        ipAddress,
                        ipType,
                        admin_id,
                        "Internal Storage/University",
                        "Create",
                        "1",
                        `{id: ${result.insertId}}`,
                        null,
                        () => { }
                    );

                    res.json({
                        status: true,
                        message: "University created successfully",
                        service: result,
                    });
                }
            );
        });
    });
};

exports.list = (req, res) => {
    const { admin_id, _token } = req.query;

    let missingFields = [];
    if (!admin_id || admin_id === "") missingFields.push("Admin ID");
    if (!_token || _token === "") missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }
    const action = "client_overview";
    Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
        if (!result.status) {
            return res.status(403).json({
                status: false,
                message: result.message, // Return the message from the authorization function
            });
        }
        Common.isAdminTokenValid(_token, admin_id, (err, result) => {
            if (err) {
                console.error("Error checking token validity:", err);
                return res.status(500).json(err);
            }

            if (!result.status) {
                return res.status(401).json({ status: false, message: result.message });
            }

            const newToken = result.newToken;

            University.list((err, result) => {
                if (err) {
                    console.error("Database error:", err);
                    return res
                        .status(500)
                        .json({ status: false, message: err.message, token: newToken });
                }

                res.json({
                    status: true,
                    message: "Universities fetched successfully",
                    services: result,
                    totalResults: result.length,
                    token: newToken,
                });
            });
        });
    });
};

exports.update = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const {
        id,
        university_name,
        university_address,
        contact_name,
        designation,
        mobile_number,
        email_id,
        scope_of_services,
        pricing,
        turnaround_time,
        standard_process,
        verification_link,
        remark,
        admin_id,
        _token,
    } = req.body;

    let missingFields = [];
    const requiredFields = {
        id: "University ID",
        admin_id: "Admin ID",
        _token: "Token",
    };

    for (let field in requiredFields) {
        if (!req.body[field] || (typeof req.body[field] === 'string' && req.body[field].trim() === "")) {
            missingFields.push(requiredFields[field]);
        }
    }

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }

    const action = "client_overview";
    Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
        if (!result.status) {
            // Check the status returned by the authorization function
            return res.status(403).json({
                status: false,
                message: result.message, // Return the message from the authorization function
            });
        }
        Common.isAdminTokenValid(_token, admin_id, (err, result) => {
            if (err) {
                console.error("Error checking token validity:", err);
                return res.status(500).json(err);
            }

            if (!result.status) {
                return res.status(401).json({ status: false, message: result.message });
            }

            const newToken = result.newToken;

            University.getById(id, (err, currentUniversity) => {
                if (err) {
                    console.error("Error fetching service data:", err);
                    return res.status(500).json({
                        status: false,
                        message: err.message,
                        token: newToken,
                    });
                }

                const changes = {
                    old: currentUniversity.title,
                    new: {
                        university_name,
                        university_address,
                        contact_name,
                        designation,
                        mobile_number,
                        email_id,
                        scope_of_services,
                        pricing,
                        turnaround_time,
                        standard_process,
                        verification_link,
                        remark,
                    },
                };

                University.update(
                    id,
                    university_name,
                    university_address,
                    contact_name,
                    designation,
                    mobile_number,
                    email_id,
                    scope_of_services,
                    pricing,
                    turnaround_time,
                    standard_process,
                    verification_link,
                    remark,
                    (err, result) => {
                        if (err) {
                            console.error("Database error:", err);
                            Common.adminActivityLog(
                                ipAddress,
                                ipType,
                                admin_id,
                                "Internal Storage/University",
                                "Update",
                                "0",
                                JSON.stringify({ id, ...changes }),
                                err,
                                () => { }
                            );
                            return res
                                .status(500)
                                .json({ status: false, message: err.message, token: newToken });
                        }

                        Common.adminActivityLog(
                            ipAddress,
                            ipType,
                            admin_id,
                            "Internal Storage/University",
                            "Update",
                            "1",
                            JSON.stringify({ id, ...changes }),
                            null,
                            () => { }
                        );

                        return res.json({
                            status: true,
                            message: "University updated successfully",
                            service: result,
                            token: newToken,
                        });
                    }
                );
            });
        });
    });
};

exports.delete = (req, res) => {
    const { ipAddress, ipType } = getClientIpAddress(req);

    const { id, admin_id, _token } = req.query;

    let missingFields = [];
    if (!id || id === "") missingFields.push("University ID");
    if (!admin_id || admin_id === "") missingFields.push("Admin ID");
    if (!_token || _token === "") missingFields.push("Token");

    if (missingFields.length > 0) {
        return res.status(400).json({
            status: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
    }
    const action = "client_overview";
    Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
        if (!result.status) {
            // Check the status returned by the authorization function
            return res.status(403).json({
                status: false,
                message: result.message, // Return the message from the authorization function
            });
        }
        Common.isAdminTokenValid(_token, admin_id, (err, result) => {
            if (err) {
                console.error("Error checking token validity:", err);
                return res.status(500).json(err);
            }

            if (!result.status) {
                return res.status(401).json({ status: false, message: result.message });
            }

            const newToken = result.newToken;

            University.getById(id, (err, currentUniversity) => {
                if (err) {
                    console.error("Error fetching service data:", err);
                    return res.status(500).json({
                        status: false,
                        message: err.message,
                        token: newToken,
                    });
                }

                University.delete(id, (err, result) => {
                    if (err) {
                        console.error("Database error:", err);
                        Common.adminActivityLog(
                            ipAddress,
                            ipType,
                            admin_id,
                            "Internal Storage/University",
                            "Delete",
                            "0",
                            JSON.stringify({ id, ...currentUniversity }),
                            err,
                            () => { }
                        );
                        return res
                            .status(500)
                            .json({ status: false, message: err.message, token: newToken });
                    }

                    Common.adminActivityLog(
                        ipAddress,
                        ipType,
                        admin_id,
                        "Internal Storage/University",
                        "Delete",
                        "1",
                        JSON.stringify(currentUniversity),
                        null,
                        () => { }
                    );

                    return res.json({
                        status: true,
                        message: "University deleted successfully",
                        token: newToken,
                    });
                });
            });
        });
    });
};
