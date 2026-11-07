import type {Employee,ShiftConfig} from './data';
export function effectiveWorkShift(employee:Employee,base:ShiftConfig,location:string,day:string,daily?:{start?:string;end?:string}):ShiftConfig{
 const weekday=new Date(day+'T12:00:00Z').getUTCDay();
 const normal={...base,...(employee.weekdayShiftEnds?.[String(weekday)]?{end:employee.weekdayShiftEnds[String(weekday)]}:{}),...daily};
 return day>='2026-11-08'&&weekday===0&&location==='Matriz'?{...normal,start:'09:00',end:'15:00',name:'Domingo Matriz',lunchStart:'',lunchEnd:''}:normal;
}
