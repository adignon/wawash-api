import vine from '@vinejs/vine'

export const pickingDayValidator = vine.createRule(async (value, {hourOnly}:any, field) => {
    if (!hourOnly && value instanceof Array) {
        if (!(value[0] >= 1 && value[0] <= 7)) {
            field.report(
                '{{ field }} doit avoir un jour de collecte valide',
                'weekDayPicking',
                field
            )
            return
        }
        if (!(value[1] instanceof Array && ["07:00 09:00", "12:00 15:00", "17:00 19:00"].includes(value[1].join(" ")))) {
            field.report(
                '{{ field }} doit avoir des horaires de collectes valide',
                'weekDayPicking',
                field
            )
            return
        }
    }else {
        if (!(value instanceof Array && ["07:00 09:00", "12:00 15:00", "17:00 19:00"].includes(value.join(" ")))) {
            field.report(
                '{{ field }} doit avoir des horaires de collectes valide',
                'weekDayPicking',
                field
            )
            return
        }
    }
})