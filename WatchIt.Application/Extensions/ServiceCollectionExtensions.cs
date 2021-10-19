using System.Reflection;
using MediatR;
using Microsoft.Extensions.DependencyInjection;

namespace WatchIt.Application.Extensions
{

    public static class ServiceCollectionExtensions
    {
        public static void AddApplication(this IServiceCollection serviceCollection)
        {
            serviceCollection.AddMediatR(Assembly.GetExecutingAssembly());
        }
    }
}
