import tkinter as tk

def on_enter(event, entry):
    text = entry.get()
    print(f"You typed: {text}")  # Replace this with your logic
    root.destroy()  # Close overlay after enter (or keep it open)

root = tk.Tk()

def main():
    # root.overrideredirect(True)  # Remove window decorations
    root.wm_attributes("-type", "splash")  # Hints to WM: no taskbar, no border
    root.attributes('-topmost', True)
    root.geometry("300x50+500+300")  # Width x Height + X + Y
    root.configure(bg='black')
    root.attributes('-alpha', 0.8)  # Slight transparency

    entry = tk.Entry(root, font=('Arial', 16))
    entry.pack(fill='both', expand=True, padx=10, pady=10)
    entry.bind('<Return>', lambda event: on_enter(event, entry))
    entry.focus()

    root.mainloop()

if __name__ == "__main__":
    main()