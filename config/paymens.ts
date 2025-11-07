import { FedaPay } from "#services/gateways/fedapay_service";

export const PAYMENT_ADDRESS_TYPES = {
    "BJ": {
        "mtnmomo": {
            code: "mtnmomo",
            name: "MTN Mobile Money",
            pattern: /^(22901)\d{8}$/
        },
        "moovmomo": {
            code: "moovmomo",
            name: "Moov Money",
            pattern: /^(22901)\d{8}$/
        },
        "celtiscash": {
            code: "celtiscash",
            name: "Celtiis Cash",
            pattern: /^(22901)\d{8}$/,
        }
    }
}

const PAYMENT_METHODS = {
    'Fedapay': new FedaPay()
}

export default PAYMENT_METHODS