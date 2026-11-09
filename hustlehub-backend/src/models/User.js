
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            maxlength: [100, "Name cannot exceed 100 characters"]
        },
        surname: {
            type: String,
            required: [true, "Surname is required"],
            trim: true,
            maxlength: [100, "Surname cannot exceed 100 characters"]
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            maxlength: [254, "Email cannot exceed 254 characters"],
            validate: {
                validator(value) {
                    if (typeof value !== "string") {
                        return false;
                    }

                    if (value.length > 254) {
                        return false;
                    }

                    const atIndex = value.indexOf("@");

                    if (
                        atIndex <= 0 ||
                        atIndex !== value.lastIndexOf("@") ||
                        atIndex === value.length - 1
                    ) {
                        return false;
                    }

                    const localPart = value.slice(0, atIndex);
                    const domain = value.slice(atIndex + 1);
                    const dotIndex = domain.lastIndexOf(".");

                    if (
                        dotIndex <= 0 ||
                        dotIndex === domain.length - 1
                    ) {
                        return false;
                    }

                    return (
                        !/\s/.test(localPart) &&
                        !/\s/.test(domain)
                    );
                },
                message: "Please provide a valid email address"
            }
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            select: false
        },
        role: {
            type: String,
            required: true,
            enum: {
                values: ["client", "freelancer"],
                message: "Role must be client or freelancer"
            },
            default: "client"
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

module.exports = mongoose.model("User", userSchema);