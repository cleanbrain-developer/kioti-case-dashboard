import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, useNavigation } from 'react-day-picker';
import type { CaptionProps } from 'react-day-picker';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Context shared between Calendar and its custom Caption ──────────────────
interface NavCtxValue {
  pickerMode: 'days' | 'grid';
  pickerYear: number;
  setPickerMode: (m: 'days' | 'grid') => void;
  setPickerYear: (y: number) => void;
}
const NavCtx = React.createContext<NavCtxValue>({
  pickerMode: 'days', pickerYear: new Date().getFullYear(),
  setPickerMode: () => {}, setPickerYear: () => {},
});

// ── Custom caption ──────────────────────────────────────────────────────────
function CustomCaption({ displayMonth }: CaptionProps) {
  const { goToMonth } = useNavigation();
  const { pickerMode, pickerYear, setPickerMode, setPickerYear } = React.useContext(NavCtx);

  const curYear = new Date().getFullYear();
  const minYear = 2018;
  const maxYear = curYear + 3;

  if (pickerMode === 'grid') {
    return (
      <div className="space-y-2 px-0.5">
        {/* Year strip */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={pickerYear <= minYear}
            onClick={() => setPickerYear(pickerYear - 1)}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'h-7 w-7 p-0 disabled:opacity-25'
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold tabular-nums">{pickerYear}</span>
          <button
            type="button"
            disabled={pickerYear >= maxYear}
            onClick={() => setPickerYear(pickerYear + 1)}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'h-7 w-7 p-0 disabled:opacity-25'
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* 3 × 4 month grid */}
        <div className="grid grid-cols-3 gap-1">
          {SHORT_MONTHS.map((m, i) => {
            const isActive =
              i === displayMonth.getMonth() &&
              pickerYear === displayMonth.getFullYear();
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  goToMonth(new Date(pickerYear, i, 1));
                  setPickerMode('days');
                }}
                className={cn(
                  'rounded-md py-1.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground text-foreground'
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Default: day-view caption — just a clickable "Month Year" label
  // (prev/next arrows are rendered by DayPicker's Nav and sit absolute over this)
  return (
    <div className="flex justify-center items-center relative h-7">
      <button
        type="button"
        onClick={() => {
          setPickerYear(displayMonth.getFullYear());
          setPickerMode('grid');
        }}
        className={cn(
          'text-sm font-semibold rounded-md px-2 py-0.5 transition-colors',
          'hover:bg-accent hover:text-primary'
        )}
      >
        {format(displayMonth, 'MMMM yyyy')}
      </button>
    </div>
  );
}

// ── Calendar ────────────────────────────────────────────────────────────────
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const [pickerMode, setPickerMode] = React.useState<'days' | 'grid'>('days');
  const [pickerYear, setPickerYear] = React.useState(new Date().getFullYear());

  return (
    <NavCtx.Provider value={{ pickerMode, pickerYear, setPickerMode, setPickerYear }}>
      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn('p-3', className)}
        classNames={{
          months  : 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
          month   : 'space-y-4',
          caption : 'flex justify-center pt-1 relative items-center',
          caption_label: 'text-sm font-medium',
          // hide DayPicker's built-in nav arrows while month grid is open
          nav: cn(
            'space-x-1 flex items-center',
            pickerMode === 'grid' && 'invisible pointer-events-none'
          ),
          nav_button: cn(
            buttonVariants({ variant: 'outline' }),
            'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
          ),
          nav_button_previous: 'absolute left-1',
          nav_button_next    : 'absolute right-1',
          // hide day grid while month grid is open
          table    : cn('w-full border-collapse space-y-1', pickerMode === 'grid' && 'hidden'),
          head_row : 'flex',
          head_cell: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
          row      : 'flex w-full mt-2',
          cell     : 'h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20',
          day: cn(
            buttonVariants({ variant: 'ghost' }),
            'h-9 w-9 p-0 font-normal aria-selected:opacity-100'
          ),
          day_selected : 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
          day_today    : 'bg-accent text-accent-foreground font-semibold',
          day_outside  : 'text-muted-foreground opacity-40',
          day_disabled : 'text-muted-foreground opacity-30',
          day_hidden   : 'invisible',
          ...classNames,
        }}
        components={{
          Caption   : CustomCaption,
          IconLeft  : () => <ChevronLeft  className="h-4 w-4" />,
          IconRight : () => <ChevronRight className="h-4 w-4" />,
        }}
        {...props}
      />
    </NavCtx.Provider>
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
