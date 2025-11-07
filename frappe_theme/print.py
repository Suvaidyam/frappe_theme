class ColorPrint:
	@staticmethod
	def red(*args):
		print(f"\033[91m{' '.join(map(str, args))}\033[0m")

	@staticmethod
	def green(*args):
		print(f"\033[92m{' '.join(map(str, args))}\033[0m")

	@staticmethod
	def yellow(*args):
		print(f"\033[93m{' '.join(map(str, args))}\033[0m")

	@staticmethod
	def blue(*args):
		print(f"\033[94m{' '.join(map(str, args))}\033[0m")

	@staticmethod
	def magenta(*args):
		print(f"\033[95m{' '.join(map(str, args))}\033[0m")

	@staticmethod
	def cyan(*args):
		print(f"\033[96m{' '.join(map(str, args))}\033[0m")

	@staticmethod
	def default(*args):
		print(f"\033[0m{' '.join(map(str, args))}\033[0m")
