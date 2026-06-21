import React from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

export default function Payment() {
    const initialOptions = {
        clientId: "AX4y0joh46hrm6hb-mHi_3DgaeKIRXjchX1vQw3cpeVbgQjKK8WH9S-KmbmBRIPCPJHmrlwOdcDW9vnA",
        // Add other options as needed
    };
    return (
        <div>
            <PayPalScriptProvider options={initialOptions}>
                <PayPalButtons />
            </PayPalScriptProvider>
        </div>
    );
}