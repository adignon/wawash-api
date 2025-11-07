
import scheduler from 'adonisjs-scheduler/services/main'
import env from './env.js'

if (env.get("NODE_ENV") == "production") {
    scheduler.command("check:payins").everyFiveMinutes();
    scheduler.command("check:payouts").everyFiveMinutes(); 
}else{
    scheduler.command("check:payins").everyFiveSeconds();
    scheduler.command("check:payouts").everyFiveSeconds();
}
