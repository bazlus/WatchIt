namespace WatchIt.Application.Common;

using System.Linq;
using System.Reflection;
using AutoMapper;

public class AutoMapperProfile : Profile
{
    public AutoMapperProfile()
    {
        ApplyConventionalMappingsForAssembly(Assembly.GetExecutingAssembly());
    }

    private void ApplyConventionalMappingsForAssembly(Assembly assembly)
    {
        var types = assembly
            .ExportedTypes
            .Where(t => t.GetInterfaces()
                .Any(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IMapFrom<>)));

        foreach (var type in types)
        {
            var mapToType = type.GetInterfaces()
                .FirstOrDefault(i => i.IsGenericType
                                     && i.GetGenericTypeDefinition() == typeof(IMapFrom<>))
                ?.GetGenericArguments()[0];

            this.CreateMap(mapToType, type);
        }
    }

}
